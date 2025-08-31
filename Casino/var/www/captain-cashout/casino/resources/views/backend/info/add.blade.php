@extends('backend.layouts.app')

@section('page-title', trans('app.add_info'))
@section('page-heading', trans('app.add_info'))

@section('content')

<section class="content-header">
	@include('backend.partials.messages')
</section>

<section class="content">
	<form action="{{ route('backend.info.store') }}" method="POST" enctype="multipart/form-data" id="info-form">
		@csrf
		<div class="box box-default">
			<div class="box-header with-border">
				<h3 class="box-title">@lang('app.add_info')</h3>
			</div>

			<div class="box-body">

				@include('backend.info.partials.base', ['edit' => false, 'profile' => false])

			</div>

			<div class="box-footer">
				<button type="submit" class="btn btn-primary">
					@lang('app.add_info')
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