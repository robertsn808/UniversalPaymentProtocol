@extends('backend.layouts.app')

@section('page-title', trans('app.add_refund'))
@section('page-heading', trans('app.add_refund'))

@section('content')

<section class="content-header">
	@include('backend.partials.messages')
</section>

<section class="content">
	<div class="box box-default">
		<form action="{{ route('backend.refunds.store') }}" method="POST" enctype="multipart/form-data" id="refund-form">
			@csrf
			<div class="box-header with-border">
				<h3 class="box-title">@lang('app.add_refund')</h3>
			</div>

			<div class="box-body">
				<div class="row">
					@include('backend.refunds.partials.base', ['edit' => false, 'profile' => false])
				</div>
			</div>

			<div class="box-footer">
				<button type="submit" class="btn btn-primary">
					@lang('app.add_refund')
				</button>
			</div>
		</form>
	</div>
</section>

@stop