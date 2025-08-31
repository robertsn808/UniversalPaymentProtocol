@extends('backend.layouts.app')

@section('page-title', trans('app.change'))
@section('page-heading', trans('app.change'))

@section('content')

<section class="content-header">
	@include('backend.partials.messages')
</section>

<section class="content">

	<form action="{{ route('backend.banks.update.do') }}" method="POST" class="pb-2 mb-3 border-bottom-light">
		<div class="box box-danger ">
			<div class="box-header with-border">
				<input type="hidden" value="<?= csrf_token() ?>" name="_token">
				<input type="hidden" value="{{ implode(',', $ids) }}" name="ids">
				<h3 class="box-title">@lang('app.change')</h3>
			</div>
			<div class="box-body">
				<div class="row">

					<div class="col-md-12">
						<ul>
							@foreach($banks as $bank)
								<li>{{ $bank->shop ? $bank->shop->name : 'No shop' }}</li>
							@endforeach
						</ul>
					</div>

					@php
						$percents = array_combine([''] + \VanguardLTE\GameBank::$values['banks'], ['---'] + \VanguardLTE\GameBank::$values['banks']);
					@endphp

					<div class="col-md-6">
						<div class="form-group">
							<label>@lang('app.slots')</label>
							<select name="slots" class="form-control">
								@foreach($percents as $key => $value)
									<option value="{{ $key }}" {{ Request::get('percent') == $key ? 'selected' : '' }}>{{ $value }}</option>
								@endforeach
							</select>
						</div>
					</div>

					<div class="col-md-6">
						<div class="form-group">
							<label>@lang('app.little')</label>
							<select name="little" class="form-control">
								@foreach($percents as $key => $value)
									<option value="{{ $key }}" {{ Request::get('percent') == $key ? 'selected' : '' }}>{{ $value }}</option>
								@endforeach
							</select>
						</div>
					</div>

					<div class="col-md-6">
						<div class="form-group">
							<label>@lang('app.table_bank')</label>
							<select name="table_bank" class="form-control">
								@foreach($percents as $key => $value)
									<option value="{{ $key }}" {{ Request::get('percent') == $key ? 'selected' : '' }}>{{ $value }}</option>
								@endforeach
							</select>
						</div>
					</div>

					<div class="col-md-6">
						<div class="form-group">
							<label>@lang('app.fish')</label>
							<select name="fish" class="form-control">
								@foreach($percents as $key => $value)
									<option value="{{ $key }}" {{ Request::get('percent') == $key ? 'selected' : '' }}>{{ $value }}</option>
								@endforeach
							</select>
						</div>
					</div>

					<div class="col-md-6">
						<div class="form-group">
							<label>@lang('app.bonus')</label>
							<select name="bonus" class="form-control">
								@foreach($percents as $key => $value)
									<option value="{{ $key }}" {{ Request::get('percent') == $key ? 'selected' : '' }}>{{ $value }}</option>
								@endforeach
							</select>
						</div>
					</div>


				</div>
			</div>
			<div class="box-footer">
				<button type="submit" class="btn btn-primary">
					@lang('app.change')
				</button>
			</div>
		</div>
	</form>



</section>

@stop

@section('scripts')


@stop