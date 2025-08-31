@extends('backend.layouts.app')

@section('page-title', 'Add ticket')
@section('page-heading', 'Add ticket')

@section('content')

<section class="content-header">
	@include('backend.partials.messages')
</section>

<section class="content">
	<form action="{{ route('backend.support.store') }}" method="POST">
		@csrf
		<div class="box box-default">
			<div class="box-header with-border">
				<h3 class="box-title">Add ticket</h3>
			</div>

			<div class="box-body">
				<div class="row">
					<div class="col-md-12">
						<div class="form-group">
							<label>Theme</label>
							<input type="text" class="form-control" name="theme" value="" required>
						</div>
					</div>
				</div>
				@if(auth()->user()->hasRole('admin'))
					<div class="row">
						<div class="col-md-12">
							<div class="form-group">
								<label>User</label>
								<select name="user_id" class="form-control select2" style="width: 100%;" required>
									<option value=""> </option>
									@foreach($users as $key => $value)
										<option value="{{ $key }}">{{ $value }}</option>
									@endforeach
								</select>
							</div>
						</div>
					</div>
				@endif
				<div class="row">
					<div class="col-md-12">
						<div class="form-group">
							<label>Text</label>
							<textarea name="text" class="form-control textarea" id="editor"></textarea>
						</div>
					</div>
				</div>
			</div>

			<div class="box-footer">
				<button type="submit" class="btn btn-primary">
					Add ticket
				</button>
			</div>
		</div>
	</form>
</section>

@stop

@section('scripts')
<script>
	initSample();
</script>
@stop